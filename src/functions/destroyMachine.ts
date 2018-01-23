import { EC2 } from "aws-sdk"
import { Machine } from "@iepaas/machine-provider-abstract"
import { createError } from "../support/AWSProviderError"

export const destroyMachine = (ec2: EC2, machine: Machine) =>
	new Promise<void>((resolve, reject) => {
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
	})
