## 🚧 🚧 Under Construction 🚧 🚧

We're upgrading the Toolkit: cleaning off the rough edges off of APIs,
improving the implementations, and deprecating legacy code.

[Current Status](#current-status) has more details.

# The NPE Toolkit

## Overview

The NPE Toolkit is a set of libraries, guides, blueprints, and sample code, to
enable rapidly building 0-1 applications on iOS, Android and web, originally
used to help accelerate products in Meta's New Product Experimentation team.

As a 0-1 app builder, you should spend your time building the features that make
your app special! The Toolkit provides out-of-the box functionality for common
app flows, including login, settings, profiles, onboarding, and notifications,
so you can focus on your app's unique value proposition.

We’ve also made it easy to customize the screens, flows, and behaviors as your
app grows, as it’s not realistic to have a one-size-fits-all UI experience that
will work for all apps and at all stages. To the extent possible, tools in the
Toolkit are independently adoptable. Specifically all pre-built user-facing
screens are easy to swap out with your own version as your product matures.

The Toolkit is built on top of React Native on the client side (including React
Native web for web applications). We will support multiple server platforms in
the Toolkit, but to start we are building on top of Firebase which has
higher-level services for authentication, data access, storage, and managed
deployment of server-side functionality that give you a strong baseline to build
upon.

## Current Status

The Toolkit is undergoing significant renovations and the is not a stable base to 
build on currently. If you're interested in using the work-in-progress, you should
pinning to a specific version or forking into your own repo.

What's changing

- Primitives for logging, auth, flags, and data access are getting a API refresh
  and being plugged into dependency injection so they can work both in client
  and server code.

> GOAL: Business logic runs both on client and server.
>
> _The fastest iteration on new apps is when almost all functionality is in the
> client code. But much of this code needs to be moved to the server as you roll
> out, both for scale and to enforce key invariants._

- Prebuilt screens will be skinnable beyond just colors. You can provide your
  own implementations for `Button`, `TextInput` and other commmon UI elements so
  that the app can be customize for your look and feel.

> GOAL: **Your** consistent look and feel across the app.
>
> _You shouldn't spend your time (especially at the staart) building auth flows,
> settings screens, profile editors, or admin consoles. But these screens have
> to feel like they are a part of your application._

- Data APIs are adding support for client caching, invalidation, and listening
  for changes in the client data state.

> GOAL: Don't make the same request twice.
>
> _If data hasn't changed from your last known client state, you shouldn't need
> a new request to the server. This is a small part of work of the upcomingwork
> on the Data API—more details coming soon._

- Old code is being removed, and code that isn't ready for primee time will be
  clearly marked.

We're building a few apps on top of the revised toolkit, and when these go live
with users we'll take off the "Under Construction" flags.

---

## Getting started

### Create your new Toolkit app from a template

To run your first build, run the following (replacing `your-toolkit-app` with
the name of your app):

```
git clone https://github.com/npe-toolkit/npe-toolkit.git
yarn create expo-app your-toolkit-app -t favezilla
```

Because the toolkit is under active, daily development and hasn't cut an initial
release, you need to clone the GitHub source code to build apps on the Toolkit.

### Setting up Firebase

Current Toolkit app templates require a Firebase backend to log in and store
data. To set up Firebase for your project, follow the steps at
[Configuring Firebase](docs/getting-started/Firebase.md) - this should take
under 10 minutes.

We're evaluating whether it makes sense to deploy a common project so that when
you first spin up a Toolkit app you'll have a backend — this has a lot of pros
and cons, so for now you need to create your own Firebase project.

### Running the app

Run the app locally using the following commands at the root of your project:

- `yarn web` to run the web app
- `yarn ios` to run the iOS app (will run in Expo Go)
- `yarn admin` to run the admin console
  - You will need to deploy
    [Firebase functions](docs/getting-started/Functions.md) in order to run the
    admin console

### If you have a different directory structure

The default app setup expects your app's directory to be a sibling of the
`npe-toolkit` directory.

If you are installing to a different location, you need to create a symlink
peer, using the following command:

```
ln -snf $PATH_TO_NPE_TOOLKIT $YOUR_APP_DIR/../npe-toolkit
```

## License

The NPE Toolkit is MIT licensed, as found in the [LICENSE](LICENSE) file.
