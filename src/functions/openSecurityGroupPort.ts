import { EC2, STS } from "aws-sdk"
import { IpPermission } from "aws-sdk/clients/ec2"
import { createError } from "../support/AWSProviderError"
import { SecurityGroupRule } from "../interfaces/SecurityGroupRule"
import { SecurityGroupSourceType } from "../enums/SecurityGruoupSourceType"

export const openSecurityGroupPort = (
	ec2: EC2,
	sts: STS,
	id: string,
	rules: Array<SecurityGroupRule>
) =>
	new Promise<void>((resolve, reject) => {
		sts.getCallerIdentity({}, (err, data) => {
			if (err || !data.Account) {
				reject(err)
			} else {
				ec2.authorizeSecurityGroupIngress(
					{
						GroupId: id,
						IpPermissions: rules.map(rule =>
							makeIpPermissionForRule(rule, data.Account!)
						)
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
			}
		})
	})

const makeIpPermissionForRule = (
	rule: SecurityGroupRule,
	accountId: string
): IpPermission => {
	const { from, to } =
		typeof rule.ports === "number"
			? { from: rule.ports, to: rule.ports }
			: rule.ports

	const ipPermission: IpPermission = {
		IpProtocol: "tcp",
		FromPort: from,
		ToPort: to
	}

	switch (rule.type) {
		case SecurityGroupSourceType.ALL_TRAFFIC:
			ipPermission.IpRanges = [
				{
					CidrIp: "0.0.0.0/0"
				}
			]
			ipPermission.Ipv6Ranges = [
				{
					CidrIpv6: "::/0"
				}
			]
			break

		case SecurityGroupSourceType.ADDRESS:
			ipPermission.IpRanges = rule.sourceAddresses.map(it => ({
				CidrIp: `${it}/32`
			}))
			break

		case SecurityGroupSourceType.GROUP:
			ipPermission.UserIdGroupPairs = [
				{
					GroupId: rule.sourceGroup,
					UserId: accountId
				}
			]
			break
	}

	return ipPermission
}
