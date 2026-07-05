const StatCard = ({ label, value, accent = false, suffix = "" }) => (
  <div className="card p-5">
    <p className="label !mb-2">{label}</p>
    <p className={`font-data text-3xl font-medium ${accent ? "text-ember" : "text-ink"}`}>
      {value}
      {suffix && <span className="ml-1 text-base text-ink/40">{suffix}</span>}
    </p>
  </div>
);

export default StatCard;
