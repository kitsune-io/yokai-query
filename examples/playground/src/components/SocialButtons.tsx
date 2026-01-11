import type { CSSProperties } from "react";

type SocialProvider =
  | "google"
  | "github"
  | "discord"
  | "apple"
  | "twitter"
  | "facebook"
  | "instagram"
  | "reddit";

type SocialButtonProps = {
  provider: SocialProvider;
  onClick?: () => void;
  label?: string;
  iconSrc?: string;
  className?: string;
  buttonStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  iconStyle?: CSSProperties;
};

const providers: Record<
  SocialProvider,
  { label: string; icon: string; className: string }
> = {
  google: {
    label: "Sign in with Google",
    icon: "/src/assets/providers/google.svg",
    className: "social-google",
  },
  github: {
    label: "Sign in with GitHub",
    icon: "/src/assets/providers/github.svg",
    className: "social-github",
  },
  discord: {
    label: "Sign in with Discord",
    icon: "/src/assets/providers/discord.svg",
    className: "social-discord",
  },
  apple: {
    label: "Sign in with Apple",
    icon: "/src/assets/providers/apple.svg",
    className: "social-apple",
  },
  twitter: {
    label: "Sign in with X",
    icon: "/src/assets/providers/twitter.svg",
    className: "social-twitter",
  },
  facebook: {
    label: "Sign in with Facebook",
    icon: "/src/assets/providers/facebook.svg",
    className: "social-facebook",
  },
  instagram: {
    label: "Sign in with Instagram",
    icon: "/src/assets/providers/instagram.svg",
    className: "social-instagram",
  },
  reddit: {
    label: "Sign in with Reddit",
    icon: "/src/assets/providers/reddit.svg",
    className: "social-reddit",
  },
};

export function SocialButton({
  provider,
  onClick,
  label,
  iconSrc,
  className,
  buttonStyle,
  labelStyle,
  iconStyle,
}: SocialButtonProps) {
  const base = providers[provider];
  const resolvedLabel = label ?? base.label;
  const resolvedIcon = iconSrc ?? base.icon;
  const resolvedClassName = className ?? base.className;
  return (
    <button
      className={`social-button ${resolvedClassName}`}
      onClick={onClick}
      style={buttonStyle}
    >
      <span className="social-icon" style={iconStyle}>
        <img src={resolvedIcon} alt="" aria-hidden="true" />
      </span>
      <span className="social-label" style={labelStyle}>
        {resolvedLabel}
      </span>
    </button>
  );
}

export function SocialButtonsGrid({
  onClick,
  overrides,
}: {
  onClick?: (provider: SocialProvider) => void;
  overrides?: Partial<Record<SocialProvider, Omit<SocialButtonProps, "provider">>>;
}) {
  return (
    <div className="social-grid">
      {(
        [
          "google",
          "github",
          "discord",
          "apple",
          "twitter",
          "facebook",
          "instagram",
          "reddit",
        ] as SocialProvider[]
      ).map((provider) => (
        <SocialButton
          key={provider}
          provider={provider}
          onClick={() => onClick?.(provider)}
          {...overrides?.[provider]}
        />
      ))}
    </div>
  );
}
