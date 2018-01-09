import { EC2 } from "aws-sdk"
import { Machine, Snapshot } from "@iepaas/machine-provider-abstract"
import { randomString } from "../support/randomString"

export const takeSnapshotOfMachine = (ec2: EC2, machine: Machine) =>
	new Promise<Snapshot>((resolve, reject) => {
		ec2.createImage(
			{
				InstanceId: machine.id,
				Name: `iepaas-${randomString(6)}`
			},
			(err, data) => {
				if (err || !data.ImageId) {
					reject(err)
				} else {
					const id = data.ImageId
					ec2.waitFor("imageAvailable", { ImageIds: [id] }, err => {
						if (err) {
							reject(err)
						} else {
							resolve({ id })
						}
					})
				}
			}
		)
	})
