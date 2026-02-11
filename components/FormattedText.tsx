import React from "react";
import { Text, type TextProps, StyleSheet } from "react-native";

interface FormattedTextProps extends TextProps {
  children: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  children,
  style,
  ...props
}) => {
  if (typeof children !== "string") {
    return <Text style={style} {...props}>{children}</Text>;
  }

  // Split by **bold** and *italic* parts.
  const parts = children.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return (
    <Text style={style} {...props}>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const content = part.substring(2, part.length - 2);
          return (
            <Text key={index} style={styles.bold}>
              {content}
            </Text>
          );
        }

        if (part.startsWith("*") && part.endsWith("*")) {
          const content = part.substring(1, part.length - 1);
          return (
            <Text key={index} style={styles.italic}>
              {content}
            </Text>
          );
        }

        return part;
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
});
