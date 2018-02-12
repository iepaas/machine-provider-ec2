import { Snapshot } from "@iepaas/machine-provider-abstract"

export interface CreateMachineOptions {
	readonly appName: string
	readonly machineName: string
	readonly subnetId: string
	readonly securityGroupId: string
	readonly size: string
	readonly initCommands: Array<string>
	readonly region: string
	readonly postInitCommands?: Array<string>
	readonly snapshot?: Snapshot
	readonly elasticIpAllocationId?: string
}
