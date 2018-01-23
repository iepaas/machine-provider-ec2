import { EC2 } from "aws-sdk"
import { createError } from "../support/AWSProviderError"

export interface PortRange {
	from: number
	to: number
}

export const createSecurityGroup = (
	ec2: EC2,
	vpc: string,
	name: string,
	description: string,
	ports: Array<number | PortRange>,
	addresses: Array<string> = []
) =>
	new Promise<string>((resolve, reject) => {
		ec2.createSecurityGroup(
			{
				GroupName: name,
				Description: description,
				VpcId: vpc
			},
			(err, data) => {
				if (err) {
					reject(createError(err, "Trying to create a security group"))
				} else {
					const { GroupId } = data

					ec2.authorizeSecurityGroupIngress(
						{
							GroupId,
							IpPermissions: ports.map(it => ({
								IpProtocol: "tcp",
								FromPort: typeof it === "number" ? it : it.from,
								ToPort: typeof it === "number" ? it : it.to,
								IpRanges:
									addresses.length === 0
										? [{ CidrIp: "0.0.0.0/0" }]
										: addresses.map(it => ({
												CidrIp: `${it}/32`
											}))
							}))
						},
						err => {
							if (err) {
								reject(
									createError(
										err,
										`Trying to authorize an inbound rule on ${GroupId}`
									)
								)
							} else {
								resolve(GroupId)
							}
						}
					)
				}
			}
		)
	})
