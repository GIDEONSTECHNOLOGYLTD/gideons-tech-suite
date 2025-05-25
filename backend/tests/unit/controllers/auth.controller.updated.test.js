// ... (keep all the existing code until line 348)
      
      // Verify findOne was called with direct email match
      expect(findOneMock).toHaveBeenCalledWith({
        email: 'newuser@example.com'
      });
      
      // Rest of the file remains the same...
      
      // In the login test, update the findOne expectation to:
      expect(findOneMock).toHaveBeenCalledWith({
        email: {
          $regex: /^test@example.com$/i,
          $options: 'i'
        }
      });
      
      // ... rest of the file
