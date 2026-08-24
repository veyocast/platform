import Image from "next/image";

export function AuthBrand() {
  return (
    <Image
      alt="VeyoCast"
      className="auth-brand"
      height={34}
      priority
      src="/brand/veyocast-logo-primary.svg"
      width={142}
    />
  );
}
