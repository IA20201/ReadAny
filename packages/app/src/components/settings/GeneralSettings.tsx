import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
/**
 * GeneralSettings — language and other general app-level settings.
 * Theme/appearance settings are now in AppearanceSettings.
 */
import { useTranslation } from "react-i18next";

export function GeneralSettings() {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = async (lang: string) => {
    const { changeAndPersistLanguage } = await import("@readany/core/i18n");
    await changeAndPersistLanguage(lang);
  };

  return (
    <div className="space-y-6 p-4 pt-3">
      {/* Language Section */}
      <section className="rounded-lg bg-muted/60 p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">{t("settings.language")}</h2>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-foreground">{t("settings.language")}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t("settings.languageDesc")}</p>
          </div>
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="zh">{t("settings.simplifiedChinese", "中文")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}
