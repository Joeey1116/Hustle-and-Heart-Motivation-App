import StoreKit
import SwiftUI

// MARK: - Model

/// Real quotes from the app's own library (data/quotes/en.json), embedded
/// here so the clip needs no network and no JavaScript. The quote changes
/// every day (day-of-year pick); "Another one" cycles to the next.
private let quotes: [String] = [
  "You didn't come this far just to come this far. Keep going.",
  "The only bad day is the one where you quit. Everything else is just a lesson.",
  "Your breakthrough is always sitting on the other side of the moment you want to give up.",
  "Stop waiting to feel ready. Ready is a lie. Start messy, start scared, just start.",
  "Nobody is coming to save you — and that's the best news ever, because it means YOU get to save you.",
  "One year from now you'll wish you started today. So start today.",
  "Discipline is choosing what you want most over what you want right now.",
  "You are allowed to be a work in progress and a masterpiece at the same time.",
  "The pain of discipline weighs ounces. The pain of regret weighs tons.",
  "Don't downgrade your dreams to match your reality. Upgrade your effort to match your dreams.",
  "Small steps every day beat giant leaps once a year. 1000%.",
  "Your future self is begging you not to quit today.",
]

// MARK: - View

struct ContentView: View {
  /// The URL that launched this clip, if any (App Clip Code / link).
  let invocationURL: URL?

  @State private var quoteIndex: Int = ContentView.todaysQuoteIndex()
  @State private var showAppStoreOverlay = false

  private static func todaysQuoteIndex() -> Int {
    let day = Calendar.current.ordinality(of: .day, in: .year, for: Date()) ?? 1
    return (day - 1) % quotes.count
  }

  private var quote: String { quotes[quoteIndex] }

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()
      ScrollView {
        VStack(spacing: 28) {
          header
          quoteSection
          actionsSection
          footer
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
      }
    }
    .preferredColorScheme(.dark)
    .appStoreOverlay(isPresented: $showAppStoreOverlay) {
      // Full Hustle & Heart Motivation app in the App Store.
      SKOverlay.AppConfiguration(appIdentifier: "6821567537", position: .bottom)
    }
  }

  // MARK: Sections

  private var header: some View {
    VStack(spacing: 8) {
      Text("APP CLIP")
        .font(.caption.weight(.bold))
        .tracking(2)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.white.opacity(0.15))
        .clipShape(Capsule())
      Text("Hustle & Heart")
        .font(.system(size: 34, weight: .black))
        .foregroundColor(.white)
        .multilineTextAlignment(.center)
      Text("You are not alone. You are loved.")
        .font(.headline)
        .foregroundColor(.white.opacity(0.75))
        .multilineTextAlignment(.center)
    }
  }

  private var quoteSection: some View {
    VStack(spacing: 16) {
      Text("Today's motivation")
        .font(.caption.weight(.semibold))
        .tracking(1)
        .foregroundColor(.white.opacity(0.6))
      Text(quote)
        .font(.system(size: 26, weight: .bold))
        .foregroundColor(.white)
        .multilineTextAlignment(.center)
        .lineSpacing(4)
      Button {
        quoteIndex = (quoteIndex + 1) % quotes.count
      } label: {
        Text("Another one")
          .font(.subheadline.weight(.semibold))
          .foregroundColor(.white.opacity(0.8))
          .padding(.horizontal, 16)
          .padding(.vertical, 8)
          .background(Color.white.opacity(0.12))
          .clipShape(Capsule())
      }
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 8)
  }

  private var actionsSection: some View {
    VStack(spacing: 12) {
      Button {
        showAppStoreOverlay = true
      } label: {
        Text("Get the full app — free")
          .font(.headline)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 14)
          .background(Color.white)
          .foregroundColor(.black)
          .clipShape(RoundedRectangle(cornerRadius: 12))
      }
      Link(destination: URL(string: "hustleandheart://")!) {
        Text("Already have the app? Open it")
          .font(.subheadline.weight(.semibold))
          .foregroundColor(.white.opacity(0.7))
      }
    }
  }

  private var footer: some View {
    Text("Hustle & Heart Motivation · Gratitude, streaks, and a daily push to keep going.")
      .font(.caption)
      .foregroundColor(.white.opacity(0.45))
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity)
  }
}
