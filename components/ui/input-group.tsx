import type { ComponentProps } from "react";

// Input Group, following the shadcn/ui component of the same name: a bordered field that holds a
// control and addons (buttons, hints) as one unit. Styled with this site's colour variables; the
// `.input-group` rules live in app/globals.css.

function join(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function InputGroup({ className, ...props }: ComponentProps<"div">) {
  return <div role="group" data-slot="input-group" className={join("input-group", className)} {...props} />;
}

const ADDON_ALIGN = {
  "inline-start": "order-first pl-3",
  "inline-end": "order-last pr-3",
  "block-start": "order-first w-full px-2.5 pt-2.5",
  "block-end": "order-last w-full px-2.5 pb-2.5",
};

export function InputGroupAddon({
  align = "inline-start",
  className,
  ...props
}: ComponentProps<"div"> & { align?: keyof typeof ADDON_ALIGN }) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={join("flex items-center gap-2 text-[13px] text-soft", ADDON_ALIGN[align], className)}
      {...props}
    />
  );
}

const BUTTON_VARIANT = {
  // With nothing to send the filled button turns into a quiet grey disc, so it is calm but never missing.
  default:
    "bg-accent text-bg shadow-[0_1px_2px_rgb(16_17_19/0.2)] hover:opacity-85 disabled:bg-chip disabled:text-soft disabled:opacity-100 disabled:shadow-none",
  ghost: "text-body hover:bg-chip hover:text-strong disabled:opacity-50",
};
const BUTTON_SIZE = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  "icon-sm": "size-[34px]",
};

export function InputGroupButton({
  variant = "ghost",
  size = "sm",
  pill = false,
  type = "button",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON_VARIANT; size?: keyof typeof BUTTON_SIZE; pill?: boolean }) {
  return (
    <button
      type={type}
      data-slot="input-group-button"
      className={join(
        "inline-flex shrink-0 cursor-pointer items-center justify-center transition-[background-color,color,opacity,transform] active:scale-[0.96] disabled:cursor-not-allowed disabled:active:scale-100",
        pill ? "rounded-full" : "rounded-[10px]",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupTextarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="input-group-control"
      className={join(
        "block w-full flex-1 resize-none bg-transparent text-[16.5px] leading-[24px] text-strong placeholder:text-soft disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}
