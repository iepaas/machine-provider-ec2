import { EC2 } from "aws-sdk"
import { createError } from "../support/AWSProviderError"
import { SecurityGroupRule } from "../interfaces/SecurityGroupRule"
import { openSecurityGroupPorts } from "./openSecurityGroupPort"

export const createSecurityGroup = (
	ec2: EC2,
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
						openSecurityGroupPorts(ec2, GroupId, rules).then(() => GroupId)
					)
				}
			}
		)
	})
