import { PortRange } from "./PortRange"
import { SecurityGroupSourceType } from "../enums/SecurityGruoupSourceType"

export interface AbstractSecurityGroupRule {
	ports: number | PortRange
	type: SecurityGroupSourceType
}

export interface AllTrafficSecurityGroupRule extends AbstractSecurityGroupRule {
	type: SecurityGroupSourceType.ALL_TRAFFIC
}

export interface AddressOnlySecurityGroupRule
	extends AbstractSecurityGroupRule {
	type: SecurityGroupSourceType.ADDRESS
	sourceAddresses: Array<string>
}

export interface GroupOnlySecurityGroupRule extends AbstractSecurityGroupRule {
	type: SecurityGroupSourceType.GROUP
	sourceGroup: string
}

export type SecurityGroupRule =
	| AllTrafficSecurityGroupRule
	| AddressOnlySecurityGroupRule
	| GroupOnlySecurityGroupRule
