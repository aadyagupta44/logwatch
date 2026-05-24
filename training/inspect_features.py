import csv, statistics
rows = list(csv.DictReader(open("/data/data/features.csv")))
labels = [r["label"] for r in rows]
print("Total rows:", len(rows))
print("Normal:", labels.count("0"), "Anomaly:", labels.count("1"))
anom = [float(r["error_ratio"]) for r in rows if r["label"]=="1"]
norm = [float(r["error_ratio"]) for r in rows if r["label"]=="0"]
print("error_ratio anomaly: min=%.3f max=%.3f mean=%.3f" % (min(anom), max(anom), statistics.mean(anom)))
print("error_ratio normal:  min=%.3f max=%.3f mean=%.3f" % (min(norm), max(norm), statistics.mean(norm)))
tc_a = [float(r["total_count"]) for r in rows if r["label"]=="1"]
tc_n = [float(r["total_count"]) for r in rows if r["label"]=="0"]
print("total_count anomaly: min=%.0f max=%.0f mean=%.1f" % (min(tc_a), max(tc_a), statistics.mean(tc_a)))
print("total_count normal:  min=%.0f max=%.0f mean=%.1f" % (min(tc_n), max(tc_n), statistics.mean(tc_n)))
uc_a = [float(r["unique_components"]) for r in rows if r["label"]=="1"]
uc_n = [float(r["unique_components"]) for r in rows if r["label"]=="0"]
print("unique_components anomaly: min=%.0f max=%.0f mean=%.1f" % (min(uc_a), max(uc_a), statistics.mean(uc_a)))
print("unique_components normal:  min=%.0f max=%.0f mean=%.1f" % (min(uc_n), max(uc_n), statistics.mean(uc_n)))
