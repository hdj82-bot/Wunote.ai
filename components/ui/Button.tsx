import { forwardRef, type ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}

const VARIANT = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-indigo-600 hover:bg-indigo-50",
};

const SIZE = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-1.5 text-sm",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className = "", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`rounded-md font-medium transition disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
});

export default Button;
