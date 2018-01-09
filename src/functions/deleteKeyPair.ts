import { EC2 } from "aws-sdk"

export const deleteKeyPair = (ec2: EC2, name: string) =>
	new Promise<void>((resolve, reject) => {
		ec2.deleteKeyPair(
			{
				KeyName: name
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
