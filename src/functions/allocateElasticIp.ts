import { EC2 } from "aws-sdk"

export const allocateElasticIp = (ec2: EC2) =>
	new Promise<string>((resolve, reject) => {
		ec2.allocateAddress(
			{
				Domain: "vpc"
			},
			(err, data) => {
				if (err) {
					reject(err)
				} else {
					resolve(data.AllocationId)
				}
			}
		)
	})
