import { EC2 } from "aws-sdk"
import { Machine, Snapshot } from "@iepaas/machine-provider-abstract"
import { randomString } from "../support/randomString"
import { createError } from "../support/AWSProviderError"

export const takeSnapshotOfMachine = (ec2: EC2, machine: Machine) =>
	new Promise<Snapshot>((resolve, reject) => {
		ec2.createImage(
			{
				InstanceId: machine.id,
				Name: `iepaas-${randomString(6)}`
			},
			(err, data) => {
				if (err || !data.ImageId) {
					reject(createError(err, `Taking a snapshot of machine ${machine.id}`))
				} else {
					const id = data.ImageId
					ec2.waitFor("imageAvailable", { ImageIds: [id] }, err => {
						if (err) {
							reject(
								createError(err, `Waiting for imageAvailable on snapshot ${id}`)
							)
						} else {
							resolve({ id })
						}
					})
				}
			}
		)
	})
