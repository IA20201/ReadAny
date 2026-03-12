/**
 * PasswordInput — TextInput with show/hide toggle for secret fields.
 */
import { useState } from "react";
import { View, TextInput, TouchableOpacity, type TextInputProps, type ViewStyle } from "react-native";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icon";
import { useColors } from "@/styles/theme";

interface PasswordInputProps extends TextInputProps {
  containerStyle?: ViewStyle;
}

export function PasswordInput({ containerStyle, style, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const colors = useColors();

  return (
    <View style={[{ position: "relative", justifyContent: "center" }, containerStyle]}>
      <TextInput
        {...props}
        secureTextEntry={!visible}
        style={[style, { paddingRight: 36 }]}
      />
      <TouchableOpacity
        onPress={() => setVisible(!visible)}
        style={{
          position: "absolute",
          right: 8,
          padding: 4,
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {visible ? (
          <EyeOffIcon size={16} color={colors.mutedForeground} />
        ) : (
          <EyeIcon size={16} color={colors.mutedForeground} />
        )}
      </TouchableOpacity>
    </View>
  );
}
