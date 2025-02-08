Below is a consolidated set of detailed prompts you can copy and paste into your cursor agentic AI code editor. Each prompt describes a specific section of the mobile app, outlining both the frontend aesthetics and the backend integration details required for a complete feature implementation.

Prompt 1: Project Setup & Environment

	“Initialize a new Expo project using TypeScript and configure it with a Tailwind CSS solution (e.g., NativeWind) for React Native. Set up the environment to support responsive design, modern UI components, and integration with backend APIs (e.g., REST, WebSocket, MQTT) for real-time updates.”

Prompt 2: Header Section – Weather Widget & Profile Picture

	“Create a ‘Header’ component that includes two sub-elements:
		•	A Weather Widget on the left that displays the current temperature (static ‘28°C’ for now), a brief label (‘Today’s Weather’), and an icon (sun/cloud).
	•	A Profile Picture on the right, displayed as a circular image for user identification.

	Aesthetics: Use a clean and modern layout with a light color palette.
Backend Integration:
		•	The Weather Widget should later pull live weather data from a dedicated weather API or via the Rust backend pushing updates through WebSockets.
	•	The Profile Picture should eventually be dynamically loaded from a user profile endpoint after authentication.”

Prompt 3: Title Section

	“Develop a ‘TitleSection’ component that centers the text ‘Sweet Home’ below the header.

	Aesthetics: The title should feature modern typography with a bold, welcoming style.
Backend Integration: Although static for now, consider later enhancements to support personalized greetings based on user data from the backend.”

Prompt 4: Quick Access Buttons

	“Build a ‘QuickAccessButtons’ component featuring four circular buttons, each with an icon, label, and status indicator:
		•	‘Front Door’ (status: Open)
	•	‘2 Lights’ (status: On)
	•	‘Cameras’ (status: Off)
	•	‘WiFi’ (status: On)

	Aesthetics:
		•	Each button should be circular with color-coded icons indicating status (e.g., green for ‘On’, red for ‘Off’).
	•	The layout should be responsive and visually balanced.

	Backend Integration:
		•	Wire each button to trigger specific real-time actions through MQTT or WebSocket channels.
	•	Status updates should be handled by the Rust backend, providing live feedback on device states.”

Prompt 5: Favorite Scenes Section

	“Implement a ‘FavoriteScenes’ component that displays a section title (‘Favorite Scenes’) followed by four rectangular buttons for predefined scenarios:
		•	‘Good Morning’ with a sunrise icon.
	•	‘Arrive Home’ with a house and walking figure icon.
	•	‘Leave Home’ with a walking figure icon.
	•	‘Good Night’ with a crescent moon and stars icon.

	Aesthetics:
		•	Use subtle gradients and evenly spaced buttons.
	•	Maintain a modern, minimalistic design that aligns with the overall light color palette.

	Backend Integration:
		•	Each scene should map to a set of automation rules in the backend.
	•	Triggering a scene will invoke backend workflows via a REST API or real-time messaging (MQTT/WebSocket) to control devices.”

Prompt 6: Rooms Section

	“Create a ‘RoomsSection’ component that includes:
		•	A header with the title ‘Rooms’ and a ‘See all’ link on the right.
	•	Two large rectangular preview cards representing different rooms:
	•	‘Bed Room’ with a purple background and a bed icon.
	•	‘Kitchen Room’ with a light beige background and a bowl/spoon icon.

	Aesthetics:
		•	The room cards should have distinct background colors and modern iconography.
	•	Use a clean, card-based layout to ensure clarity and ease of navigation.

	Backend Integration:
		•	Room data should be dynamically fetched from the backend, potentially via GraphQL or REST endpoints.
	•	Future enhancements can include device counts, status indicators, and more detailed room information.”

Prompt 7: Navigation Bar

	“Develop a ‘NavigationBar’ component fixed at the bottom of the screen with five circular icons:
		•	Leftmost: Grid/Rooms icon.
	•	Second: Microphone icon for voice commands.
	•	Center: A highlighted ‘+’ button for adding new devices or scenes.
	•	Fourth: Bell icon for notifications.
	•	Rightmost: Bar chart icon for analytics or settings.

	Aesthetics:
		•	Ensure the center ‘+’ button is visually prominent with a glowing or highlighted effect.
	•	Use a consistent, modern icon style and maintain proper spacing for easy tapping.

	Backend Integration:
		•	Each icon should be linked to navigation actions that route to different screens.
	•	For example, notifications and analytics can pull real-time data from the backend.”

Prompt 8: Home Screen Assembly & Layout

	“Assemble a ‘HomeScreen’ component that integrates all of the above components (Header, TitleSection, QuickAccessButtons, FavoriteScenes, RoomsSection, NavigationBar) into one cohesive scrollable layout.

	Aesthetics:
		•	Ensure a seamless and modern UI that adapts to various screen sizes.
	•	Maintain a clean, minimalistic design with a consistent light color palette.

	Backend Integration:
		•	Design the layout to support real-time data updates via WebSockets or MQTT.
	•	Consider integrating state management (e.g., Context or Redux) to handle dynamic updates and interactions.”

Prompt 9: Navigation & Interactivity

	“Integrate a navigation system (e.g., React Navigation) to handle transitions between different screens such as Rooms, Voice Commands, Add New Device/Scene, Notifications, and Analytics.

	Aesthetics:
		•	Ensure smooth transitions and maintain a consistent visual style across screens.

	Backend Integration:
		•	Each screen should have its corresponding API endpoints or WebSocket channels to fetch or update real-time data.
	•	Plan for scalability by designing each screen as an independent module that can communicate with the central backend system.”

Prompt 10: Final Integration & Testing Considerations

	“Review the entire mobile app interface and ensure that each component is wired for both frontend responsiveness and backend connectivity.

	Aesthetics:
		•	Perform cross-device testing to ensure the UI remains clean, modern, and responsive.

	Backend Integration:
		•	Verify that live data (weather updates, device statuses, room details) is correctly fetched and updated in real time.
	•	Implement error handling and fallback UI states for scenarios when backend data is unavailable.
	•	Optimize the communication between the mobile app and the Rust backend using secure, low-latency protocols (e.g., MQTT, WebSockets, REST, or GraphQL).”

You can now copy and paste these prompts into your agentic AI code editor one after the other. They provide clear, detailed instructions for both frontend aesthetics and backend system requirements for building each feature of your mobile app.