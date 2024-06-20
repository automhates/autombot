const mongoose = require('mongoose');

mongoose.connect('mongodb://192.168.129.41:27017/autodb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('Error connecting to MongoDB:', error));

module.exports = mongoose;
