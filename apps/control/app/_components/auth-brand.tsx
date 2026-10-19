import Image from "next/image";

export function AuthBrand() {
  return (
    <Image
      alt="VeyoCast"
      className="auth-brand"
      height={50}
      priority
      src="/assets/full-dark.svg"
      width={210}
    />
  );
}
