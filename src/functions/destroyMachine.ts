import { EC2 } from "aws-sdk"
import { Machine } from "@iepaas/machine-provider-abstract"
import { createError } from "../support/AWSProviderError"

export async function destroyMachine(ec2: EC2, machine: Machine) {
	const eip = await getMachineElasticIp(ec2, machine)
	await terminateMachine(ec2, machine)
	await waitForMachineTerminated(ec2, machine)

	if (eip) {
		await releaseElasticIp(ec2, eip)
	}
}

export const getMachineElasticIp = (ec2: EC2, machine: Machine) =>
	new Promise<string | null>((resolve, reject) =>
		ec2.describeAddresses(
			{
				Filters: [
					{
						Name: "instance-id",
						Values: [machine.id]
					}
				]
			},
			(err, data) => {
				if (err || !data.Addresses) {
					reject(
						createError(
							err,
							`Trying to get the elastic IP of instance ${machine.id}`
						)
					)
				} else {
					resolve(
						data.Addresses.length > 0 ? data.Addresses[0].AllocationId : null
					)
				}
			}
		)
	)

export const releaseElasticIp = (ec2: EC2, allocationId: string) =>
	new Promise<void>((resolve, reject) =>
		ec2.releaseAddress(
			{
				AllocationId: allocationId
			},
			err => {
				if (err) {
					reject(
						createError(err, `Trying to release the elastic IP ${allocationId}`)
					)
				} else {
					resolve()
				}
			}
		)
	)

const terminateMachine = (ec2: EC2, machine: Machine) =>
	new Promise<void>((resolve, reject) =>
		ec2.terminateInstances(
			{
				InstanceIds: [machine.id]
			},
			err => {
				if (err) {
					reject(createError(err, `Trying to terminate instance ${machine.id}`))
				} else {
					resolve()
				}
			}
		)
	)

const waitForMachineTerminated = (ec2: EC2, machine: Machine) =>
	new Promise<void>((resolve, reject) =>
		ec2.waitFor(
			"instanceTerminated",
			{
				InstanceIds: [machine.id]
			},
			err => {
				if (err) {
					reject(
						createError(
							err,
							`Waiting for instance ${machine.id} to be terminated`
						)
					)
				} else {
					resolve()
				}
			}
		)
	)
