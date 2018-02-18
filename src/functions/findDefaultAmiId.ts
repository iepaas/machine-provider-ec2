/*
 * Extracted from here: https://cloud-images.ubuntu.com/locator/ec2/releasesTable
 * By running this code:
 * data
 *     .filter(it => it[2] === "16.04 LTS")
 *     .filter(it => it[4] === "hvm:ebs-ssd")
 *     .reduce((l, r) => {
 *         l[r[0]] = r[6].match(/<a href=".+">(.+)<\/a>/)[1]
 *         return l
 *     }, {})
 */
const amisByRegion: { [key: string]: string } = {
	"ap-south-1": "ami-88d98ae7",
	"us-east-1": "ami-0b383171",
	"ap-northeast-1": "ami-adceb9cb",
	"ap-southeast-2": "ami-e1c43f83",
	"eu-west-1": "ami-c1167eb8",
	"ap-southeast-1": "ami-a55c1dd9",
	"eu-west-2": "ami-e0bc5987",
	"ca-central-1": "ami-c7a622a3",
	"ap-northeast-2": "ami-35a3015b",
	"us-west-2": "ami-c62eaabe",
	"us-west-1": "ami-9cb2bdfc",
	"eu-central-1": "ami-714f2b1e",
	"sa-east-1": "ami-9a2d63f6",
	"us-east-2": "ami-4f80b52a",
	"eu-west-3": "ami-6bad1b16",
	"cn-north-1": "ami-cc4499a1",
	"cn-northwest-1": "ami-fd0e1a9f",
	"us-gov-west-1": "ami-77199016"
}

export const findDefaultAmiId = (region: string) => amisByRegion[region]
