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
          account_id: APISchemas.id_field,
          project_id: APISchemas.id_field,
          website_id: APISchemas.id_field,
          start_date: {type: :string, format: 'date', nullable: true, description: 'Campaign start date'},
          end_date: {type: :string, format: 'date', nullable: true, description: 'Campaign end date'},
          time_zone: {type: :string, description: 'Campaign time zone'},
          daily_budget_cents: {type: :integer, nullable: true, description: 'Daily budget in cents'},
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
                    _destroy: {type: :boolean},
                    ads_attributes: {
                      type: :array,
                      items: {
                        type: :object,
                        properties: {
                          id: {type: :integer},
                          _destroy: {type: :boolean},
                          headlines_attributes: {
                            type: :array,
                            items: {
                              type: :object,
                              properties: {
                                id: {type: :integer},
                                text: {type: :string},
                                _destroy: {type: :boolean}
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
                                _destroy: {type: :boolean}
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
                          _destroy: {type: :boolean}
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
                    _destroy: {type: :boolean}
                  }
                }
              },
              structured_snippet_attributes: {
                type: :object,
                properties: {
                  id: {type: :integer},
                  header: {type: :string},
                  values: {type: :array, items: {type: :string}}
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
                    geo_target_constant: {type: :string},
                    targeted: {type: :boolean},
                    radius: {type: :number},
                    radius_units: {type: :string}
                  }
                }
              },
              ad_schedules: {
                type: :object,
                properties: {
                  time_zone: {type: :string},
                  always_on: {type: :boolean},
                  schedules: {type: :array}
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
  end
end
