import Image from "next/image"

export default function LogoSMV({ height = 28 }: { height?: number }) {
  return (
    <Image
      src="/smv-logo.png"
      alt="SMV"
      width={Math.round(height * 2.87)}
      height={height}
      className="object-contain"
      priority
    />
  )
}
