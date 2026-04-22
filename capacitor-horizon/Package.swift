// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorHorizon",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorHorizon",
            targets: ["CapacitorHorizonPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "CapacitorHorizonPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CapacitorHorizonPlugin"),
        .testTarget(
            name: "CapacitorHorizonPluginTests",
            dependencies: ["CapacitorHorizonPlugin"],
            path: "ios/Tests/CapacitorHorizonPluginTests")
    ]
)