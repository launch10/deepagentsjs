# frozen_string_literal: true

module APISchemas
  module Campaign
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          name: {type: :string, description: 'Campaign name'},
          stage: {type: :string, description: 'Current campaign stage'},
          status: {type: :string, description: 'Campaign status'},
          ready_for_next_stage: {type: :boolean, description: 'Whether campaign is ready to advance to next stage'},
          account_id: APISchemas.id_field,
          project_id: APISchemas.id_field,
          website_id: APISchemas.id_field,
          start_date: {type: :string, format: 'date', nullable: true, description: 'Campaign start date'},
          end_date: {type: :string, format: 'date', nullable: true, description: 'Campaign end date'},
          time_zone: {type: :string, description: 'Campaign time zone'},
          daily_budget_cents: {type: :integer, nullable: true, description: 'Daily budget in cents'},
          google_advertising_channel_type: {type: :string, nullable: true, description: 'Google Ads channel type'},
          google_bidding_strategy: {type: :string, nullable: true, description: 'Google Ads bidding strategy'},
          ad_groups: {
            type: :array,
            items: {
              type: :object,
              properties: {
                id: APISchemas.id_field,
                name: {type: :string},
                ads: {
                  type: :array,
                  items: {
                    type: :object,
                    properties: {
                      id: APISchemas.id_field,
                      headlines: {
                        type: :array,
                        items: {
                          type: :object,
                          properties: {
                            id: APISchemas.id_field,
                            text: {type: :string},
                            position: {type: :integer}
                          }
                        }
                      },
                      descriptions: {
                        type: :array,
                        items: {
                          type: :object,
                          properties: {
                            id: APISchemas.id_field,
                            text: {type: :string},
                            position: {type: :integer}
                          }
                        }
                      }
                    }
                  }
                },
                keywords: {
                  type: :array,
                  items: {
                    type: :object,
                    properties: {
                      id: APISchemas.id_field,
                      text: {type: :string},
                      match_type: {type: :string},
                      position: {type: :integer}
                    }
                  }
                }
              }
            }
          },
          callouts: {
            type: :array,
            items: {
              type: :object,
              properties: {
                id: APISchemas.id_field,
                text: {type: :string},
                position: {type: :integer}
              }
            }
          },
          structured_snippet: {
            type: :object,
            nullable: true,
            properties: {
              id: APISchemas.id_field,
              category: {type: :string},
              values: {type: :array, items: {type: :string}}
            }
          },
          workflow: {
            type: :object,
            nullable: true,
            properties: {
              step: {type: :string},
              substep: {type: :string, nullable: true}
            }
          },
          **APISchemas.timestamps
        },
        required: %w[id stage status account_id project_id website_id created_at updated_at]
      }
    end

    def self.create_params_schema
      {
        type: :object,
        properties: {
          campaign: {
            type: :object,
            properties: {
              name: {type: :string, description: 'Campaign name'},
              project_id: {type: :integer, description: 'Project ID'},
              website_id: {type: :integer, description: 'Website ID'}
            },
            required: %w[project_id website_id]
          }
        },
        required: ['campaign']
      }
    end

    def self.params_schema
      {
        type: :object,
        properties: {
          campaign: {
            type: :object,
            properties: {
              name: {type: :string, description: 'Campaign name'},
              start_date: {type: :string, format: 'date', description: 'Campaign start date'},
              end_date: {type: :string, format: 'date', description: 'Campaign end date'},
              time_zone: {type: :string, description: 'Campaign time zone'},
              daily_budget_cents: {type: :integer, description: 'Daily budget in cents'},
              google_advertising_channel_type: {type: :string, description: 'Google Ads channel type'},
              google_bidding_strategy: {type: :string, description: 'Google Ads bidding strategy'},
              ad_groups_attributes: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    id: {type: :integer},
                    name: {type: :string},
                    ads_attributes: {
                      type: :array,
                      items: {
                        type: :object,
                        properties: {
                          id: {type: :integer},
                          headlines_attributes: {
                            type: :array,
                            items: {
                              type: :object,
                              properties: {
                                id: {type: :integer},
                                text: {type: :string},
                                position: {type: :integer}
                              }
                            }
                          },
                          descriptions_attributes: {
                            type: :array,
                            items: {
                              type: :object,
                              properties: {
                                id: {type: :integer},
                                text: {type: :string},
                                position: {type: :integer}
                              }
                            }
                          }
                        }
                      }
                    },
                    keywords_attributes: {
                      type: :array,
                      items: {
                        type: :object,
                        properties: {
                          id: {type: :integer},
                          text: {type: :string},
                          match_type: {type: :string},
                          position: {type: :integer}
                        }
                      }
                    }
                  }
                }
              },
              callouts_attributes: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    id: {type: :integer},
                    text: {type: :string},
                    position: {type: :integer}
                  }
                }
              },
              structured_snippet_attributes: {
                type: :object,
                properties: {
                  id: {type: :integer},
                  category: {type: :string},
                  values: {type: :array, items: {type: :string}},
                  _destroy: {type: :boolean}
                }
              },
              location_targets: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    target_type: {type: :string},
                    location_name: {type: :string},
                    location_type: {type: :string},
                    country_code: {type: :string},
                    targeted: {type: :boolean},
                    google_criterion_id: {type: :string},
                    radius: {type: :number},
                    radius_units: {type: :string}
                  }
                }
              },
              ad_schedules: {
                type: :object,
                properties: {
                  always_on: {type: :boolean, description: 'Whether the campaign runs 24/7'},
                  start_time: {type: :string, description: 'Start time in format like "9:00am"', example: '9:00am'},
                  end_time: {type: :string, description: 'End time in format like "5:00pm"', example: '5:00pm'},
                  time_zone: {type: :string, description: 'IANA time zone', example: 'America/New_York'},
                  day_of_week: {
                    type: :array,
                    items: {type: :string},
                    description: 'Days when ads should run',
                    example: ['Monday', 'Tuesday', 'Wednesday']
                  }
                }
              }
            }
          }
        },
        required: ['campaign']
      }
    end

    def self.advance_response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          stage: {type: :string, description: 'New campaign stage after advancement'},
          status: {type: :string, description: 'Campaign status'},
          workflow: {
            type: :object,
            nullable: true,
            properties: {
              step: {type: :string},
              substep: {type: :string, nullable: true}
            }
          },
          **APISchemas.timestamps
        },
        required: %w[id stage status]
      }
    end

    def self.error_response
      APISchemas.error_response
    end
  end
end
