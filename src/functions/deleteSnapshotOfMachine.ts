import { EC2 } from "aws-sdk"
import { Snapshot } from "@iepaas/machine-provider-abstract"
import { createError } from "../support/AWSProviderError"

export const deleteSnapshotOfMachine = (ec2: EC2, snapshot: Snapshot) =>
	new Promise<void>((resolve, reject) => {
		ec2.deregisterImage(
			{
				ImageId: snapshot.id
			},
			err => {
				if (err) {
					reject(createError(err, `Trying to deregister an ${snapshot.id}`))
				} else {
					resolve()
				}
			}
		)
	})
