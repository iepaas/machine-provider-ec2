import { EC2, STS } from "aws-sdk"
import { createError } from "../support/AWSProviderError"
import { SecurityGroupRule } from "../interfaces/SecurityGroupRule"
import { openSecurityGroupPort } from "./openSecurityGroupPort"

export const createSecurityGroup = (
	ec2: EC2,
	sts: STS,
	vpc: string,
	name: string,
	description: string,
	rules: Array<SecurityGroupRule>
) =>
	new Promise<string>((resolve, reject) => {
		ec2.createSecurityGroup(
			{
				GroupName: name,
				Description: description,
				VpcId: vpc
			},
			(err, data) => {
				if (err || !data.GroupId) {
					reject(createError(err, "Trying to create a security group"))
				} else {
					const { GroupId } = data

					resolve(
						openSecurityGroupPort(ec2, sts, GroupId, rules).then(() => GroupId)
					)
				}
			}
		)
	})
