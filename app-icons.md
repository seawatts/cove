# App Icons

A unique, memorable icon communicates the purpose and personality of your app or game and can help people recognize your product at a glance in the App Store and on their devices.

![App Store Icon Grid](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-intro-dark_2x.png)
*A sketch of the App Store icon showing a rectangular and circular grid lines, tinted yellow to subtly reflect the yellow in the original six-color Apple logo.*

Beautiful app icons are an important part of the user experience on all Apple platforms and every app and game must have one. Each platform defines a slightly different style for app icons, so create a design that adapts well to different shapes and levels of detail while maintaining strong visual consistency and messaging. To download templates that help you create icons for each platform, see [Apple Design Resources](https://developer.apple.com/design/resources/).

## Best Practices

### Embrace Simplicity
Simple icons tend to be easier for people to understand and recognize. Find a concept or element that captures the essence of your app or game, make it the core idea of the icon, and express it in a simple, unique way. Avoid adding too many details, because they can be hard to discern and can make an icon appear muddy, especially at smaller sizes. Prefer a simple background that puts the emphasis on the primary image — you don't need to fill the entire icon with content.

### Cross-Platform Consistency
Create a design that works well on multiple platforms so it feels at home on each. If your app or game runs on more than one platform, use similar images and color palettes in all icons while rendering them in the style that's appropriate for each platform.

![Music App Icons Across Platforms](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-music-dark_2x.png)
*The Music app icon variations across iOS, macOS, tvOS, visionOS, and watchOS, showing consistent use of musical notes on a red background while adapting to each platform's style.*

### Text Usage
Prefer including text only when it's an essential part of your experience or brand. Text in icons is often too small to read easily, can make an icon appear cluttered, and doesn't support accessibility or localization. In some contexts, the app name appears near the icon, making it redundant to display the name within it.

### Alternate Icons
Consider offering an alternate app icon. In iOS, iPadOS, and tvOS, and iPadOS and iOS apps running in visionOS, people can choose an alternate version of an icon, which can strengthen their connection with the app or game and enhance their experience. For example, a sports app might offer different icons for different teams.

### Use Graphics Over Photos
Prefer graphical images to photos and avoid replicating UI components in your icon. Photos are full of details that don't work well when viewed at small sizes. Instead, create a graphic representation of the content that emphasizes the features you want people to notice.

### Size Optimization
If needed, optimize your icon for the specific sizes the system displays in places like Spotlight search results, Settings, and notifications. For iOS, iPadOS, and watchOS, you can tell Xcode to generate all sizes from your 1024×1024 px App Store icon.

![Safari Icon Size Comparison](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-sizes-dark_2x.png)
*The Safari app icon at 512x512 px (left) shows detailed tick marks around the compass, while the 16x16 px version (right) omits this detail for clarity.*

## Platform Considerations

### iOS and iPadOS
People can customize the appearance of their app icons to be light, dark, or tinted. You can create your own variations to ensure each looks exactly the way you want.

![iOS Icon Variants](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-modes-dark_2x.png)
*Three versions of the Music app icon showing light (white notes on red), dark (red notes on dark background), and tinted (grayscale notes on dark background) variations.*

#### Dark Mode Icons
Use your light app icon as a basis for your dark icon:
1. Choose complementary colors that reflect the default design
2. Avoid excessively bright images
3. Omit the background so the system-provided background shows through

![Dark Icon Components](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-dark-mode-dark_2x.png)
*Illustration showing how the dark icon is composed: transparent icon + system gradient background = final dark mode icon.*

#### Tinted Icons
Provide your tinted icon as a grayscale image with a vertical gradient applied uniformly over the icon image.

![Tinted Icon Components](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-tinted-mode-dark_2x.png)
*Illustration showing how the tinted icon is composed: grayscale icon + system gradient background = final tinted icon.*

### macOS
App icons share common visual attributes, including:
- Rounded-rectangle shape
- Front-facing perspective
- Level position
- Uniform drop shadow

![TextEdit Icon Example](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-textedit-dark_2x.png)
*The TextEdit icon showing ruled paper with a mechanical pencil extending beyond the rounded rectangle bounds.*

### tvOS
tvOS app icons use between two and five layers to create a sense of dynamism as people bring them into focus.

![tvOS Icon Layers](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-tv-layers-dark_2x.png)
*Example of a tvOS app icon's layer separation showing background, main content, and detail layers.*

### visionOS
A visionOS app icon is circular and includes a background layer and one or two layers on top, producing a three-dimensional object that subtly expands when people view it.

![visionOS Icon Example](https://developer.apple.com/design/human-interface-guidelines/images/intro/foundations/app-icons-vision-layers-dark_2x.png)
*Example of a visionOS app icon showing the layered composition with background and foreground elements.*

### watchOS
A watchOS app icon is circular and displays no accompanying text. The icon should be clearly visible against both light and dark backgrounds.

## Specifications

### File Format and Color Spaces
- PNG format
- Supported color spaces:
  - sRGB (color)
  - Gray Gamma 2.2 (grayscale)
  - Display P3 (wide-gamut color) for iOS, iPadOS, macOS, tvOS, and watchOS

### Required Sizes

#### iOS/iPadOS
- App Store: 1024x1024 px
- iPhone Home Screen: 180x180 px (@3x), 120x120 px (@2x)
- iPad Pro Home Screen: 167x167 px
- iPad/iPad mini Home Screen: 152x152 px

#### macOS
- App Store: 1024x1024 px
- Additional required sizes:
  - 512x512 px (@1x, @2x)
  - 256x256 px (@1x, @2x)
  - 128x128 px (@1x, @2x)
  - 32x32 px (@1x, @2x)
  - 16x16 px (@1x, @2x)

#### tvOS
- App Store: 1280x768 px
- Home Screen: 800x480 px (@2x), 400x240 px (@1x)

#### visionOS
- App Store and Home View: 1024x1024 px

#### watchOS
- App Store: 1024x1024 px
- Home Screen: varies by watch size (80x80 px to 108x108 px)
- Notification Center: 48x48 px to 66x66 px
- Short Look: 172x172 px to 258x258 px

## Resources

### Related Resources
- [Apple Design Resources](https://developer.apple.com/design/resources/)
- [SF Symbols](https://developer.apple.com/sf-symbols/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

### Developer Documentation
- [Configuring your app icon — Xcode](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)
- [Asset Catalog Format Reference](https://developer.apple.com/library/archive/documentation/Xcode/Reference/xcode_ref-Asset_Catalog_Format/)

### Videos
- [App Icon Design](https://developer.apple.com/videos/play/wwdc2019/235/)
- [Designing Award-Winning Apps](https://developer.apple.com/videos/play/wwdc2017/802/)

---

*Last updated: June 10, 2024*

*Source: [Apple Human Interface Guidelines - App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)*