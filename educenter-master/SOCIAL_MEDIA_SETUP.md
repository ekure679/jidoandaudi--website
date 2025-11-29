# Real-Time Social Media Feed Setup Instructions

This guide will help you set up real-time social media feeds on your Blessed Jildo School website.

## 🚀 Quick Start (Demo Mode)

The website is already configured with demo data and will work immediately. The social feeds will show sample content that updates automatically.

## 📋 Prerequisites

- Node.js installed (version 14 or higher)
- Social media accounts (Twitter, Facebook, LinkedIn)
- API access to social media platforms

## 🔧 Setup Steps

### 1. Install Node.js Dependencies

Open PowerShell in your project directory and run:

```powershell
cd "c:\personal folder\project\jildo website project\educenter-master"
npm install
```

### 2. Create Environment Variables

Copy the template file and configure your API keys:

```powershell
copy .env.template .env
```

Edit the `.env` file with your actual API credentials:

```env
PORT=3000
TWITTER_BEARER_TOKEN=your_actual_twitter_token
TWITTER_USERNAME=blessedjildo
FACEBOOK_ACCESS_TOKEN=your_actual_facebook_token
FACEBOOK_PAGE_ID=your_actual_page_id
LINKEDIN_ACCESS_TOKEN=your_actual_linkedin_token
LINKEDIN_COMPANY_ID=your_actual_company_id
```

### 3. Get API Credentials

#### Twitter/X API:
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a developer account
3. Create a new app
4. Generate Bearer Token
5. Add the token to your `.env` file

#### Facebook API:
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add "Pages" product
4. Generate a Page Access Token
5. Get your Page ID from Facebook Page settings
6. Add both to your `.env` file

#### LinkedIn API:
1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Create a company app
3. Request access to "Share on LinkedIn" and "Marketing Developer Platform"
4. Generate access tokens
5. Get your Company ID
6. Add both to your `.env` file

### 4. Start the Backend Server

```powershell
npm start
```

The server will start on http://localhost:3000

### 5. Update Frontend Configuration

In `js/script.js`, change the configuration:

```javascript
this.useMockData = false; // Enable real API calls
this.apiBaseUrl = 'http://localhost:3000/api'; // Your server URL
```

### 6. Test the Integration

Open your website and check that:
- ✅ Social media feeds load without errors
- ✅ Real-time updates appear every 5 minutes
- ✅ Post counts are displayed correctly

## 🔍 Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure your backend server is running
2. **API Rate Limits**: APIs have usage limits - check your quota
3. **Authentication Errors**: Verify your API keys are correct
4. **Empty Feeds**: Check that your social accounts have recent posts

### Development Mode:

For development, you can use demo data by setting:
```javascript
this.useMockData = true;
```

## 📱 Features Included

- ✅ **Real-time Updates**: Feeds refresh every 5 minutes
- ✅ **Error Handling**: Graceful fallback to demo data
- ✅ **Responsive Design**: Works on all device sizes
- ✅ **Loading States**: Shows loading spinners during API calls
- ✅ **Post Counts**: Displays number of posts in each feed
- ✅ **Time Stamps**: Shows relative time for each post
- ✅ **Engagement Data**: Likes, comments, and reactions
- ✅ **Caching**: Server-side caching to reduce API calls

## 🚀 Deployment

### For Production:

1. **Update API Base URL**: Change `apiBaseUrl` to your production server
2. **Environment Variables**: Set production API keys
3. **HTTPS**: Use HTTPS for both frontend and backend
4. **Error Monitoring**: Add logging and monitoring

### Hosting Options:

- **Backend**: Heroku, Vercel, Railway, DigitalOcean
- **Frontend**: GitHub Pages, Netlify, Vercel

## 📊 API Limits

- **Twitter**: 300 requests per 15 minutes
- **Facebook**: 200 calls per hour per user  
- **LinkedIn**: Varies by endpoint

## 🔒 Security Best Practices

- ✅ Never expose API keys in client-side code
- ✅ Use environment variables for sensitive data
- ✅ Implement rate limiting on your backend
- ✅ Use HTTPS in production
- ✅ Regularly rotate API keys

## 📞 Support

For technical issues or questions:
1. Check the browser console for error messages
2. Verify your API credentials
3. Test individual API endpoints
4. Review the server logs

---

**Note**: This setup provides a professional, real-time social media integration perfect for showcasing your vocational school's activities and engaging with your community!