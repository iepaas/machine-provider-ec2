import { MachineType } from "@iepaas/machine-provider-abstract"

export function getInstanceName(machineType: MachineType) {
	switch (machineType) {
		case MachineType.PARENT:
			return "iepaas parent"
		case MachineType.BUILD:
			return "iepaas build"
		case MachineType.CHILD:
			return "iepaas child"
	}
}
