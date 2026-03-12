import { ChevronLeftIcon } from "@/components/ui/Icon";
import { useColors, fontSize, fontWeight } from "@/styles/theme";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NotesView } from "./NotesView";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useTranslation } from "react-i18next";

/**
 * FullScreenNotesScreen — Standalone notes page without bottom tab bar.
 * Used when navigating from the Reader screen.
 */
export function FullScreenNotesScreen() {
    const colors = useColors();
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, "FullScreenNotes">>();
    const { bookId } = route.params;
    const { t } = useTranslation();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <ChevronLeftIcon size={24} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                    {t("notes.title", "笔记")}
                </Text>
                <View style={{ width: 40 }} />
            </View>
            <NotesView initialBookId={bookId} showBackButton={false} edges={[]} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.semibold,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
});
