import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = SCREEN_WIDTH - 32;

const MOCK_STORIES = [
  {
    id: "s-1",
    name: "Maria",
    age_range: "60s",
    life_areas: ["career", "immigration"],
    preview:
      "Left everything at 35 to start over in a new country with $200. Here's what she learned about betting on yourself.",
  },
  {
    id: "s-2",
    name: "Robert",
    age_range: "70s",
    life_areas: ["startup", "failure"],
    preview:
      "Lost two companies and a marriage. Then built something that actually mattered — at 62.",
  },
  {
    id: "s-3",
    name: "James",
    age_range: "60s",
    life_areas: ["career", "identity"],
    preview:
      "Spent 35 years in the wrong life. Changed everything at 58. No regrets.",
  },
  {
    id: "s-4",
    name: "Linda",
    age_range: "60s",
    life_areas: ["marriage", "reinvention"],
    preview:
      "Left a 28-year marriage at 55 and discovered who she actually was.",
  },
];

export default function FeedScreen() {
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  function handleCarouselScroll(
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    setActiveSlide(index);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLogo}>adwise</Text>
          <Text style={styles.headerBell}>🔔</Text>
        </View>

        {/* Section A: Spotlight Story Carousel */}
        <Text style={styles.sectionLabel}>✦ spotlight stories</Text>
        <ScrollView
          ref={carouselRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + 12}
          decelerationRate="fast"
          contentContainerStyle={styles.carouselContent}
          onScroll={handleCarouselScroll}
          scrollEventThrottle={16}
        >
          {MOCK_STORIES.map((story) => (
            <View key={story.id} style={styles.storyCard}>
              <View style={styles.storyCardTop}>
                <Text style={styles.storyName}>
                  {story.name},{" "}
                  <Text style={styles.storyAgeRange}>{story.age_range}</Text>
                </Text>
                <View style={styles.chipsRow}>
                  {story.life_areas.map((area) => (
                    <View key={area} style={styles.chip}>
                      <Text style={styles.chipText}>{area}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text style={styles.storyPreview}>{story.preview}</Text>
              <Pressable
                onPress={() =>
                  console.log(`read story: ${story.id}`)
                }
              >
                <Text style={styles.readMore}>read their story →</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        {/* Pagination dots */}
        <View style={styles.dotsRow}>
          {MOCK_STORIES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeSlide ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Section B: Dashboard */}
        <Text style={styles.sectionLabel}>◈ your dashboard</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>matches</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>new</Text>
          </View>
        </View>

        {/* Section C: Story feed */}
        <Text style={styles.sectionLabel}>✦ story feed</Text>
        <View style={styles.feedList}>
          {MOCK_STORIES.map((story) => (
            <Pressable
              key={story.id}
              style={styles.feedRow}
              onPress={() => console.log(`feed item pressed: ${story.id}`)}
            >
              <Text style={styles.feedPrefix}>✦ </Text>
              <View style={styles.feedTextBlock}>
                <Text style={styles.feedName}>{story.name}</Text>
                <Text style={styles.feedPreview} numberOfLines={1}>
                  {story.preview}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FDFFF5",
  },
  container: {
    flex: 1,
    backgroundColor: "#FDFFF5",
  },
  contentContainer: {
    paddingBottom: 32,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLogo: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    color: "#111",
    fontWeight: "400",
  },
  headerBell: {
    fontSize: 20,
  },

  /* Section labels */
  sectionLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#555",
    letterSpacing: 1,
    textTransform: "lowercase",
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 20,
  },

  /* Carousel */
  carouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  storyCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginRight: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: "space-between",
    minHeight: 180,
  },
  storyCardTop: {
    marginBottom: 12,
  },
  storyName: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#111",
    fontWeight: "700",
    marginBottom: 8,
  },
  storyAgeRange: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#555",
    fontWeight: "400",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: "#FDFFF5",
    borderWidth: 1,
    borderColor: "#BFFF00",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 10,
    color: "#111",
  },
  storyPreview: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#444",
    fontStyle: "italic",
    lineHeight: 20,
    marginBottom: 14,
  },
  readMore: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#BFFF00",
    fontWeight: "700",
  },

  /* Dots */
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#BFFF00",
  },
  dotInactive: {
    backgroundColor: "#DDD",
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statNumber: {
    fontFamily: "Orbit_400Regular",
    fontSize: 36,
    color: "#111",
    fontWeight: "700",
    lineHeight: 42,
  },
  statLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#555",
    marginTop: 2,
  },

  /* Feed list */
  feedList: {
    paddingHorizontal: 16,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0D0",
  },
  feedPrefix: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#BFFF00",
    marginTop: 1,
    marginRight: 4,
  },
  feedTextBlock: {
    flex: 1,
  },
  feedName: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    fontWeight: "700",
    marginBottom: 3,
  },
  feedPreview: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
});
