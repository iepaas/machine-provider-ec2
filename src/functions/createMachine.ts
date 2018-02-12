import fetch from "node-fetch"
import { EC2 } from "aws-sdk"
import { Machine, Snapshot } from "@iepaas/machine-provider-abstract"
import { CreateMachineOptions } from "../interfaces/CreateMachineOptions"
import { allocateElasticIp } from "./allocateElasticIp"
import { createError } from "../support/AWSProviderError"
import { findDefaultAmiId } from "./findDefaultAmiId"

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
		initCommands,
		postInitCommands,
		region
	} = options

	const id = await createInstances(
		ec2,
		appName,
		subnetId,
		size,
		machineName,
		securityGroupId,
		region,
		initCommands,
		postInitCommands,
		snapshot
	)
	await waitForInstancesRunning(ec2, id)
	await associateElasticIp(ec2, id, elasticIpAllocationId)
	const machine = await getInstanceInformation(ec2, id)

	await waitForCloudInitFinished(
		machine.address,
		10 /*m*/ * 60 /*s*/ * 1000 /*ms*/
	)

	// TODO errors in typings?
	/*ec2.modifyInstanceAttribute(
		{
			InstanceId: id,
			Attribute: "userData",
			UserData: [
				"#!/bin/bash",
				"# The user data has been deleted because it might have",
				"# contained sensitive information like API keys."
			].join("\n")
		},
		err => {
			if (err) {
				console.error("Failed to delete the user data!")
				console.error(err)
			}
		}
	)*/

	return machine
}

const createInstances = (
	ec2: EC2,
	appName: string,
	subnetId: string,
	size: string,
	name: string,
	securityGroup: string,
	region: string,
	initCommands: Array<string> = [],
	postInitCommands: Array<string> = [],
	snapshot?: Snapshot
) =>
	new Promise<string>((resolve, reject) =>
		ec2.runInstances(
			{
				ImageId: snapshot ? snapshot.id : findDefaultAmiId(region),
				InstanceType: size,
				MinCount: 1,
				MaxCount: 1,
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
				UserData: new Buffer(
					[
						"#!/bin/bash",
						...initCommands,
						// The following set of commands create a "Web server"
						// On port 3000 that returns 200 OK and disappears after
						// serving the first (and only) request.
						// We will poll <machine-ip>:3000 until we get
						// our answer. Then we will be able to say that the
						// machine setup has finished.
						'echo "HTTP/1.1 200 OK" | nc -l 3000 > /dev/null',
						...postInitCommands
					].join("\n"),
					"utf-8"
				).toString("base64"),
				SubnetId: subnetId
			},
			(err, data) => {
				if (
					err ||
					!data.Instances ||
					data.Instances.filter(it => !it.InstanceId).length > 0
				) {
					reject(
						createError(err, `When running an instance on subnet ${subnetId}`)
					)
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
					reject(
						createError(err, `waiting for the instance ${id} to be running`)
					)
				} else {
					resolve()
				}
			}
		)
	)

// TODO this won't work in the browser because the lack of HTTPS
// The best solution I can think of is create a middleman API that calls
// the port 3000 on our machine and returns the result
const waitForCloudInitFinished = async (address: string, timeout?: number) => {
	async function isCloudInitFinished(): Promise<boolean> {
		try {
			await fetch(`http://${address}:3000`)
			return false
		} catch (e) {
			if (e.code === "ECONNREFUSED") {
				// The server can't be reached
				// cloud-init is still running
				return false
			} else if (e.code === "ECONNRESET") {
				// The server was reached
				// cloud-init is finished
				// The behaviour of nc is odd, and CONNRESET is what we get,
				// but it's good enough
				return true
			} else {
				throw e
			}
		}
	}

	await Promise.race<void>([
		...(() => {
			if (timeout) {
				return [
					new Promise<void>((_, reject) => {
						setTimeout(() => {
							reject(
								new Error("The wait for cloud-init to finish " + "timed out")
							)
						}, timeout).unref()
					})
				]
			} else {
				return []
			}
		})(),
		(async function poll() {
			if (!await isCloudInitFinished()) {
				await new Promise(r => setTimeout(r, 500))
				await poll()
			}
		})()
	])
}

const associateElasticIp = (
	ec2: EC2,
	instanceId: string,
	ipAllocationId?: string
) =>
	new Promise<void>(async (resolve, reject) => {
		try {
			ec2.associateAddress(
				{
					AllocationId:
						ipAllocationId || (await allocateElasticIp(ec2)).allocationId,
					InstanceId: instanceId
				},
				err => {
					if (err) {
						reject(
							createError(
								err,
								`Associating an elastic IP to instance ${instanceId}`
							)
						)
					} else {
						resolve()
					}
				}
			)
		} catch (e) {
			reject(e)
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
					reject(createError(err, `querying instance info for instance ${id}`))
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
