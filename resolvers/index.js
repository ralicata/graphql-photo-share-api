import { GraphQLScalarType } from 'graphql';
import { ObjectID } from 'mongodb';
import { authorizeWithGithub } from '../lib';
import fetch from 'node-fetch';

ObjectID.prototype.valueOf = function() {
  return this.toString();
};

var users = [
  { githubLogin: 'mHattrup', name: 'Mike Hattrup' },
  { githubLogin: 'gPlake', name: 'Glen Plake' },
  { githubLogin: 'sSchmidt', name: 'Scot Schmidt' }
];

var tags = [
  { photoID: '1', userID: 'gPlake' },
  { photoID: '2', userID: 'sSchmidt' },
  { photoID: '2', userID: 'mHattrup' },
  { photoID: '2', userID: 'gPlake' }
];

const resolvers = {
  Query: {
    totalPhotos: async (parent, args, { db }) => {
      return await db.collection('photos').estimatedDocumentCount();
    },
    allPhotos: async (parent, args, { db }) => {
      return await db
        .collection('photos')
        .find()
        .toArray();
    },

    totalUsers: async (parent, args, { db }) => {
      return await db.collection('users').estimatedDocumentCount();
    },
    allUsers: async (parent, args, { db }) => {
      return await db
        .collection('users')
        .find()
        .toArray();
    },
    me: (parent, args, { currentUser }) => currentUser
  },
  Mutation: {
    async postPhoto(parent, args, { db, currentUser }) {
      if (!currentUser) {
        throw new Error('You must be authorized');
      }

      var newPhoto = {
        ...args.input,
        userID: currentUser.githubLogin,
        created: new Date()
      };
      const { insertId } = await db.collection('photos').insertOne(newPhoto);
      newPhoto.id = insertId;
      console.log(newPhoto);
      return newPhoto;
    },
    async githubAuth(parent, { code }, { db }) {
      let {
        message,
        access_token,
        avatar_url,
        login,
        name
      } = await authorizeWithGithub({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code
      });

      if (message) {
        throw new Error(message);
      }

      let latestUserInfo = {
        name,
        githubLogin: login,
        githubToken: access_token,
        avatar: avatar_url
      };

      const {
        ops: [user]
      } = await db
        .collection('users')
        .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true });

      return { user, token: access_token };
    },
    addFakeUser: async (parent, { count }, { db }) => {
      var randomUserAPI = `https://randomuser.me/api/?results=${count}`;

      var { results } = await fetch(randomUserAPI).then(res => res.json());

      var users = results.map(r => ({
        githubLogin: r.login.username,
        name: `${r.name.first} ${r.name.last}`,
        avatar: r.picture.thumbnail,
        githubToken: r.login.sha1
      }));

      await db.collection('users').insert(users);

      return users;
    },

    async fakeUserAuth(_, { githubLogin }, { db }) {
      var user = await db.collection('users').findOne({ githubLogin });

      if (!user) {
        throw new Error(`Cannot find user with githubLogin ${githubLogin}`);
      }

      return {
        token: user.githubToken,
        user
      };
    }
  },
  Photo: {
    id: parent => parent.id || parent._id,
    url: parent => `http://localhost:4000/img/${parent._id}.jpg`,
    postedBy: (parent, args, { db }) => {
      return db.collection('users').findOne({ githubLogin: parent.userID });
    },
    taggedUsers: parent =>
      tags
        // Returns an array of tags that only contains the current photo
        .filter(tag => tag.photoID === parent.id)
        // Converts the array of tags into an array of userIDs
        .map(tag => tag.userID)
        // Converts array of userIDs into an array of User objects
        .map(userID => users.find(u => u.githubLogin === userID))
  },
  User: {
    postedPhotos: parent => {
      return photos.filter(p => p.githubUser === parent.githubLogin);
    },
    inPhotos: parent =>
      tags
        // Returns an array of tags that only contains the current user
        .filter(tag => tag.userID === parent.id)
        // Converts the array of tags into an array of photoIDs
        .map(tag => tag.photoID)
        // Converts array of photoIDs into an array of Photo objects
        .map(photoID => photo.find(p => p.id === photoID))
  },
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'A valid date time value.',
    parseValue: value => new Date(value),
    serialize: value => new Date(value).toISOString(),
    parseLiteral: ast => ast.value
  })
};

module.exports = resolvers;
