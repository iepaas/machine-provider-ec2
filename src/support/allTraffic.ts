import {
	AllTrafficSecurityGroupRule,
	SecurityGroupRule
} from "../interfaces/SecurityGroupRule"
import { PortRange } from "../interfaces/PortRange"
import { SecurityGroupSourceType } from "../enums/SecurityGruoupSourceType"

export function allTraffic(
	ports: Array<number | PortRange>
): Array<SecurityGroupRule> {
	return ports.map(
		it =>
			({
				ports: it,
				type: SecurityGroupSourceType.ALL_TRAFFIC
			} as AllTrafficSecurityGroupRule)
	)
}
