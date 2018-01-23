import { EC2 } from "aws-sdk"

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
					reject(err)
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
								reject(err)
							} else {
								resolve(GroupId)
							}
						}
					)
				}
			}
		)
	})
