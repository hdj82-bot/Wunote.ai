import { forwardRef, type InputHTMLAttributes } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50 ${className}`}
        {...rest}
      />
    );
  }
);

export default Input;
