# Enable dashboard admin assignments

This feature lets the site owner add or remove dashboard admins by Gmail address. Firebase Authentication verifies each Google sign-in. Firestore Security Rules allow only the owner UID to change the list.

## One-time Firebase setup

1. In Firebase Console, open **Build > Firestore Database** and click **Create database**.
2. Choose **Production mode**, select a nearby location, then click **Enable**.
3. Open the **Rules** tab.
4. Replace every rule with the contents of `firestore.rules` in this repository.
5. Click **Publish**.

After that, open the Song Dashboard while signed in as the owner. Use **Admins** at the top to add an email address. The person can then sign in with that exact Google account.

Do not use Firestore test mode: it allows unrestricted database access.
