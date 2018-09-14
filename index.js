const { ApolloServer } = require('apollo-server');
const uuidv4 = require('uuid/v4');

const typeDefs = `
  type Photo {
    id: ID!
    url: String!
    name: String!
    description: String
  }

  type Query {
    totalPhotos: Int!
    allPhotos: [Photo!]!
  }

  type Mutation {
    postPhoto(name: String! description: String): Photo!
  }
`;

var photos = [];

const resolvers = {
  Query: {
    totalPhotos: () => photos.length,
    allPhotos: () => photos
  },
  Mutation: {
    postPhoto(parent, args) {
      var newPhoto = { id: uuidv4(), ...args };
      photos.push(newPhoto);
      return newPhoto;
    }
  },
  Photo: {
    url: parent => `http://localhost:4000/img/${parent.id}.jpg`
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers
});

server
  .listen()
  .then(({ url }) => console.log(`GraphQL Service running on ${url}`));
