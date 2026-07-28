import { Image, StyleSheet, View } from "react-native";
import brandIcon from "../../../../assets/brand/veyocast-icon-512.png";

export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="VeyoCast"
      accessibilityRole="image"
      style={{ height: size, width: size }}
    >
      <Image
        resizeMode="contain"
        source={brandIcon}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    height: "100%",
    width: "100%"
  }
});
