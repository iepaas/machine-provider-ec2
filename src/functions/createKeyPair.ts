import { EC2 } from "aws-sdk"
import { randomString } from "../support/randomString"

export const createKeyPair = (ec2: EC2) =>
	new Promise<{ name: string; content: string }>((resolve, reject) => {
		const name = `iepaas-${randomString(6)}`
		ec2.createKeyPair(
			{
				KeyName: name
			},
			(err, data) => {
				if (err) {
					reject(err)
				} else {
					resolve({
						name,
						content: data.KeyMaterial!
					})
				}
			}
		)
	})
