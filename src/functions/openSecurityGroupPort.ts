import { EC2 } from "aws-sdk"
import { createError } from "../support/AWSProviderError"
import { SecurityGroupRule } from "../interfaces/SecurityGroupRule"
import { SecurityGroupSourceType } from "../enums/SecurityGruoupSourceType"

export const openSecurityGroupPorts = (
	ec2: EC2,
	id: string,
	rules: Array<SecurityGroupRule>
) =>
	new Promise<void>((resolve, reject) =>
		ec2.authorizeSecurityGroupIngress(
			{
				GroupId: id,
				IpPermissions: rules.map(it => {
					const { from, to } =
						typeof it.ports === "number"
							? { from: it.ports, to: it.ports }
							: it.ports

					const permission: any = {
						IpProtocol: "tcp",
						FromPort: from,
						ToPort: to,
						IpRanges: (() => {
							switch (it.type) {
								case SecurityGroupSourceType.ALL_TRAFFIC:
									return [
										{
											CidrIp: "0.0.0.0/0"
										}
									]
								case SecurityGroupSourceType.ADDRESS:
									return it.sourceAddresses.map(it => ({
										CidrIp: `${it}/32`
									}))
								case SecurityGroupSourceType.GROUP:
									return []
							}
						})(),
						Ipv6Ranges: (() => {
							switch (it.type) {
								case SecurityGroupSourceType.ALL_TRAFFIC:
									return [
										{
											CidrIpv6: "::/0"
										}
									]
								default:
									return []
							}
						})()
					}

					if (it.type === SecurityGroupSourceType.GROUP) {
						permission.SourceSecurityGroup = it.sourceGroup
					}

					return permission
				})
			},
			err => {
				if (err) {
					reject(
						createError(err, `Trying to authorize an inbound rule on ${id}`)
					)
				} else {
					resolve()
				}
			}
		)
	)
