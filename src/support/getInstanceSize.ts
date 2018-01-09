import { MachineType } from "@iepaas/machine-provider-abstract"
import {
	BUILD_MACHINE_SIZE,
	CHILD_MACHINE_SIZE,
	PARENT_MACHINE_SIZE
} from "../configKeys"

export async function getInstanceSize(
	machineType: MachineType,
	getConfigValue: (key: string) => Promise<string | null>
) {
	switch (machineType) {
		case MachineType.PARENT:
			return (await getConfigValue(PARENT_MACHINE_SIZE))!
		case MachineType.BUILD:
			return (await getConfigValue(BUILD_MACHINE_SIZE))!
		case MachineType.CHILD:
			return (await getConfigValue(CHILD_MACHINE_SIZE))!
	}
}
