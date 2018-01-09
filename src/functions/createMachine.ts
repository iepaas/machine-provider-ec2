import { EC2 } from "aws-sdk"
import { Machine, Snapshot } from "@iepaas/machine-provider-abstract"
import { createKeyPair } from "./createKeyPair"
import { deleteKeyPair } from "./deleteKeyPair"
import { executeCommandsInMachine } from "./executeCommandsInMachine"
import { CreateMachineOptions } from "../interfaces/CreateMachineOptions"

export async function createMachine(
	ec2: EC2,
	options: CreateMachineOptions
): Promise<Machine> {
	const {
		appName,
		machineName,
		subnetId,
		size,
		securityGroupId,
		snapshot,
		elasticIpAllocationId,
		initCommands
	} = options

	const keyPair = await createKeyPair(ec2)

	const id = await createInstances(
		ec2,
		appName,
		subnetId,
		size,
		machineName,
		keyPair.name,
		securityGroupId,
		snapshot
	)
	await waitForInstancesRunning(ec2, id)
	await associateElasticIpIfApplicable(ec2, id, elasticIpAllocationId)
	const machine = await getInstanceInformation(ec2, id)

	await executeCommandsInMachine(
		[
			...initCommands,
			// Clear the keyPair data from the instance
			// This will make the instance unreachable from ssh
			// unless it is able to regenerate this file by itself
			"> .ssh/authorized_keys"
		],
		machine,
		keyPair.content
	)

	deleteKeyPair(ec2, keyPair.name).catch(console.error)

	return machine
}

const createInstances = (
	ec2: EC2,
	appName: string,
	subnetId: string,
	size: string,
	name: string,
	keyPair: string,
	securityGroup: string,
	snapshot?: Snapshot
) =>
	new Promise<string>((resolve, reject) =>
		ec2.runInstances(
			{
				ImageId: snapshot ? snapshot.id : "ami-8fd760f6", // xenial
				InstanceType: size,
				MinCount: 1,
				MaxCount: 1,
				KeyName: keyPair,
				SecurityGroupIds: [securityGroup],
				TagSpecifications: [
					{
						ResourceType: "instance",
						Tags: [
							{
								Key: "Name",
								Value: name
							},
							{
								Key: "iepaas-app",
								Value: appName
							}
						]
					}
				],
				SubnetId: subnetId
			},
			(err, data) => {
				if (
					err ||
					!data.Instances ||
					data.Instances.filter(it => !it.InstanceId).length > 0
				) {
					reject(new Error(`Error when creating machine: ${err.message}`))
				} else {
					resolve(data.Instances[0].InstanceId)
				}
			}
		)
	)

const waitForInstancesRunning = (ec2: EC2, id: string) =>
	new Promise<void>((resolve, reject) =>
		ec2.waitFor(
			"instanceRunning",
			{
				InstanceIds: [id]
			},
			err => {
				if (err) {
					reject(err)
				} else {
					resolve()
				}
			}
		)
	)

const associateElasticIpIfApplicable = (
	ec2: EC2,
	instanceId: string,
	ipAllocationId?: string
) =>
	new Promise<void>((resolve, reject) => {
		if (ipAllocationId) {
			ec2.associateAddress(
				{
					AllocationId: ipAllocationId,
					InstanceId: instanceId
				},
				err => {
					if (err) {
						reject(err)
					} else {
						resolve()
					}
				}
			)
		} else {
			resolve()
		}
	})

const getInstanceInformation = (ec2: EC2, id: string) =>
	new Promise<Machine>((resolve, reject) =>
		ec2.describeInstances(
			{
				InstanceIds: [id]
			},
			(err, data) => {
				if (
					err ||
					!data.Reservations ||
					!data.Reservations[0] ||
					!data.Reservations[0].Instances ||
					!data.Reservations[0].Instances![0]
				) {
					reject(err)
				} else {
					const instance = data.Reservations[0].Instances![0]

					resolve({
						id: instance.InstanceId!,
						address: instance.PublicIpAddress!
					})
				}
			}
		)
	)
