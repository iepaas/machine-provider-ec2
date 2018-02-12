export async function selectSubnet(subnets: Array<string>): Promise<string> {
	return subnets[Math.floor(Math.random() * subnets.length)]
}
