import { EC2 } from "aws-sdk"
import { Machine } from "@iepaas/machine-provider-abstract"

export const destroyMachine = (ec2: EC2, machine: Machine) =>
	new Promise<void>((resolve, reject) => {
		ec2.terminateInstances(
			{
				InstanceIds: [machine.id]
			},
			err => {
				if (err) {
					reject(err)
				} else {
					resolve()
				}
			}
		)
	})
