export default function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (<div className="mb-3"><h2 className="text-lg font-semibold">{title}</h2>{subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}</div>);
}
