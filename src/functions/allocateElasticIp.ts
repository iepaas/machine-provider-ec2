import { EC2 } from "aws-sdk"

export const allocateElasticIp = (ec2: EC2) =>
	new Promise<{ allocationId: string; address: string }>((resolve, reject) => {
		ec2.allocateAddress(
			{
				Domain: "vpc"
			},
			(err, data) => {
				if (err || !data.PublicIp || !data.AllocationId) {
					reject(err)
				} else {
					resolve({
						allocationId: data.AllocationId,
						address: data.PublicIp
					})
				}
			}
		)
	})
